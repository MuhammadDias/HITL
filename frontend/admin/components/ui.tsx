"use client";
import { useState } from "react";
import { DECISION_HINT, DECISION_LABEL, type Decision, type DecisionPercent } from "@/lib/api";

const DECISIONS: Decision[] = ["accept", "correct", "override"];

export function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function DecisionBadge({ decision }: { decision: Decision }) {
  return <span className={`badge badge-${decision}`}>{DECISION_LABEL[decision]}</span>;
}

/** Stacked bar of Menerima / Merevisi / Menolak percentages. */
export function DecisionBar({ percent, legend = false }: { percent: DecisionPercent; legend?: boolean }) {
  const empty = DECISIONS.every((d) => !percent[d]);
  return (
    <div>
      <div
        className="dbar"
        role="img"
        aria-label={DECISIONS.map((d) => `${DECISION_LABEL[d]} ${percent[d]}%`).join(", ")}
      >
        {!empty && DECISIONS.map((d) => <span key={d} className={d} style={{ width: `${percent[d]}%` }} />)}
      </div>
      {legend && (
        <div className="legend">
          {DECISIONS.map((d) => (
            <span key={d}>
              <i style={{ background: `var(--${d})` }} />
              {DECISION_LABEL[d]} {percent[d]}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** One labelled progress row per decision type. */
export function DecisionPercentList({ percent, counts }: { percent: DecisionPercent; counts?: Record<Decision, number> }) {
  return (
    <div className="pct-list">
      {DECISIONS.map((d) => (
        <div key={d} className="pct-item">
          <div className="top">
            <span>{DECISION_LABEL[d]}</span>
            <span>
              {percent[d]}%{counts && <span className="muted small"> · {counts[d]} jawaban</span>}
            </span>
          </div>
          <div className="hint">{DECISION_HINT[d]}</div>
          <div className="pct-track">
            <span style={{ width: `${percent[d]}%`, background: `var(--${d})` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="linkbox">
      <code>{url}</code>
      <button
        type="button"
        className="btn btn-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            window.prompt("Salin link ini:", url);
          }
        }}
      >
        {copied ? "Tersalin ✓" : "Salin"}
      </button>
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  return error ? <div className="alert" role="alert">{error}</div> : null;
}

export function formatDate(iso: string): string {
  // Backend stores UTC as "YYYY-MM-DD HH:MM:SS".
  const d = new Date(iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function levelName(levelId: string): string {
  const m = /^stage-(\d+)/.exec(levelId);
  return m ? `Level ${m[1]}` : levelId;
}
