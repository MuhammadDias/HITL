"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CopyLink,
  DecisionBadge,
  DecisionBar,
  DecisionPercentList,
  ErrorBox,
  StatCard,
  formatDate,
  levelName,
} from "@/components/ui";
import {
  api,
  classLink,
  DECISION_LABEL,
  downloadExport,
  submissionImageUrl,
  type ClassDetail,
  type Decision,
  type Submission,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Tab = "rekap" | "jawaban";

export default function ClassDetailPage() {
  const params = useParams<{ id: string }>();
  const classId = Number(params.id);
  const { user } = useAuth();
  const router = useRouter();
  const isSuper = user?.role === "superadmin";

  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("rekap");
  const [studentFilter, setStudentFilter] = useState<number | "">("");
  const [decisionFilter, setDecisionFilter] = useState<Decision | "">("");
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [exporting, setExporting] = useState<"csv" | "zip" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadDetail = useCallback(() => {
    api.getClass(classId).then(setDetail).catch((e) => setError(e.message));
  }, [classId]);

  useEffect(loadDetail, [loadDetail]);

  useEffect(() => {
    if (tab !== "jawaban") return;
    setSubmissions(null);
    api
      .listSubmissions(classId, {
        studentId: studentFilter === "" ? undefined : studentFilter,
        decision: decisionFilter === "" ? undefined : decisionFilter,
      })
      .then(setSubmissions)
      .catch((e) => setError(e.message));
  }, [tab, classId, studentFilter, decisionFilter]);

  if (!detail) {
    return error ? <ErrorBox error={error} /> : <div className="empty">Memuat…</div>;
  }
  const s = detail.stats;

  const runExport = async (kind: "csv" | "zip") => {
    setExporting(kind);
    setError(null);
    try {
      await downloadExport(classId, kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export gagal.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="crumb">
            <Link href="/kelas">Kelas</Link>
            {isSuper && (
              <>
                {" / "}
                <Link href={`/sekolah/${detail.school_id}`}>{detail.school_name}</Link>
              </>
            )}
          </div>
          <h1>Kelas {detail.name}</h1>
          <p>{detail.school_name} · dibuat {formatDate(detail.created_at)}</p>
        </div>
        <div className="row">
          {isSuper && (
            <>
              <button type="button" className="btn" disabled={exporting !== null} onClick={() => runExport("csv")}>
                {exporting === "csv" ? "Menyiapkan…" : "Export CSV"}
              </button>
              <button type="button" className="btn" disabled={exporting !== null} onClick={() => runExport("zip")}>
                {exporting === "zip" ? "Menyiapkan…" : "Export ZIP (CSV + gambar)"}
              </button>
            </>
          )}
          {confirmDelete ? (
            <>
              <span className="muted small">Hapus kelas & semua jawabannya?</span>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  try {
                    await api.deleteClass(classId);
                    router.replace("/kelas");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Gagal menghapus.");
                  }
                }}
              >
                Ya, hapus
              </button>
              <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Batal</button>
            </>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Hapus kelas</button>
          )}
        </div>
      </div>

      <ErrorBox error={error} />

      <div className="card">
        <div className="card-head">
          <h2>Link kelas untuk murid</h2>
          <span className="muted small">Nomor absen 1–{detail.student_count}</span>
        </div>
        <CopyLink url={classLink(detail.join_token)} />
      </div>

      <div className="grid grid-4">
        <StatCard label="Murid bergabung" value={`${s.students_joined} / ${detail.student_count}`} sub={`${s.students_active} sudah menjawab`} />
        <StatCard label="Total jawaban" value={s.total_submissions} />
        <StatCard label="Menerima (rata-rata murid)" value={`${s.student_average_percent.accept}%`} sub="Memakai tebakan #1 model" />
        <StatCard label="Menolak (rata-rata murid)" value={`${s.student_average_percent.override}%`} sub="Memberi label sendiri" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Rata-rata per murid</h2>
            <span className="muted small">rata-rata dari persentase tiap murid</span>
          </div>
          <DecisionPercentList percent={s.student_average_percent} />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Seluruh jawaban kelas</h2>
            <span className="muted small">{s.total_submissions} jawaban</span>
          </div>
          <DecisionPercentList percent={s.percent} counts={s.counts} />
        </div>
      </div>

      <div className="card">
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "rekap"} className={tab === "rekap" ? "active" : ""} onClick={() => setTab("rekap")}>
            Rekap per murid
          </button>
          <button type="button" role="tab" aria-selected={tab === "jawaban"} className={tab === "jawaban" ? "active" : ""} onClick={() => setTab("jawaban")}>
            Jawaban & gambar
          </button>
        </div>

        {tab === "rekap" ? (
          s.students.length === 0 ? (
            <div className="empty">Belum ada murid yang bergabung lewat link kelas.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="num">Absen</th>
                    <th>Nama</th>
                    <th className="num">Jawaban</th>
                    <th className="num">Menerima</th>
                    <th className="num">Merevisi</th>
                    <th className="num">Menolak</th>
                    <th>Komposisi</th>
                    <th className="num">Confidence AI</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {s.students.map((st) => (
                    <tr key={st.id}>
                      <td className="num">{st.number}</td>
                      <td><strong>{st.name}</strong></td>
                      <td className="num">{st.total}</td>
                      <td className="num">{st.percent.accept}%</td>
                      <td className="num">{st.percent.correct}%</td>
                      <td className="num">{st.percent.override}%</td>
                      <td style={{ minWidth: 140 }}><DecisionBar percent={st.percent} /></td>
                      <td className="num">
                        {st.avg_model_confidence === null ? "—" : `${Math.round(st.avg_model_confidence * 100)}%`}
                      </td>
                      <td className="num">
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={!st.total}
                          onClick={() => {
                            setStudentFilter(st.id);
                            setDecisionFilter("");
                            setTab("jawaban");
                          }}
                        >
                          Lihat jawaban
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small">
                Confidence AI = rata-rata keyakinan tebakan #1 model pada gambar murid tersebut.
              </p>
            </div>
          )
        ) : (
          <div className="stack">
            <div className="form-row">
              <label className="field">
                Murid
                <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Semua murid</option>
                  {s.students.map((st) => (
                    <option key={st.id} value={st.id}>{st.number}. {st.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                Keputusan
                <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value as Decision | "")}>
                  <option value="">Semua keputusan</option>
                  {(Object.keys(DECISION_LABEL) as Decision[]).map((d) => (
                    <option key={d} value={d}>{DECISION_LABEL[d]}</option>
                  ))}
                </select>
              </label>
            </div>
            {submissions === null ? (
              <div className="empty">Memuat…</div>
            ) : submissions.length === 0 ? (
              <div className="empty">Belum ada jawaban untuk filter ini.</div>
            ) : (
              <div className="gallery">
                {submissions.map((sub) => (
                  <SubmissionCard key={sub.id} sub={sub} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SubmissionCard({ sub }: { sub: Submission }) {
  const pickedIndex =
    sub.decision_type === "accept" ? 0 : sub.decision_type === "correct" && sub.source_rank ? sub.source_rank - 1 : -1;
  return (
    <div className="shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={submissionImageUrl(sub.id)} alt={`Gambar ${sub.student_name}, ${levelName(sub.level_id)}`} loading="lazy" />
      <div className="meta">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="who">{sub.student_number}. {sub.student_name}</span>
          <DecisionBadge decision={sub.decision_type} />
        </div>
        <div className="muted small">{levelName(sub.level_id)} · {formatDate(sub.created_at)}</div>
        <div>
          Label akhir: <strong>{sub.final_label}</strong>
        </div>
        <div className="small muted">Tebakan AI:</div>
        <ol>
          {sub.candidates.map((c, i) => (
            <li key={i} className={i === pickedIndex ? "picked" : undefined}>
              {c.label} ({Math.round(c.confidence * 100)}%)
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
