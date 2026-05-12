"use client";

import type { Vulnerability } from "@/lib/osvClient";

interface ScanSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface ResultsDashboardProps {
  vulnerabilities: Vulnerability[];
  summary: ScanSummary;
  onScanAnother: () => void;
}

const severityClass: Record<Vulnerability["severity"], string> = {
  CRITICAL: "bg-red-600/20 text-red-300 border-red-600/40",
  HIGH: "bg-orange-600/20 text-orange-300 border-orange-600/40",
  MEDIUM: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  LOW: "bg-slate-600/20 text-slate-300 border-slate-600/40",
};

const summaryCards = (summary: ScanSummary) => [
  { label: "Total Vulnerabilities", value: summary.total, style: "bg-slate-800" },
  { label: "Critical", value: summary.critical, style: "bg-red-600" },
  { label: "High", value: summary.high, style: "bg-orange-600" },
  { label: "Medium", value: summary.medium, style: "bg-yellow-600 text-slate-950" },
  { label: "Low", value: summary.low, style: "bg-slate-600" },
];

const toCsv = (rows: Vulnerability[]) => {
  const headers = [
    "cveId",
    "packageName",
    "installedVersion",
    "recommendedVersion",
    "severity",
    "description",
    "link",
  ];
  const lines = rows.map((row) =>
    [
      row.cveId,
      row.packageName,
      row.installedVersion,
      row.recommendedVersion ?? "",
      row.severity,
      row.description.replaceAll('"', '""'),
      row.link,
    ]
      .map((value) => `"${value}"`)
      .join(","),
  );

  return [headers.join(","), ...lines].join("\n");
};

const downloadFile = (filename: string, content: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function ResultsDashboard({ vulnerabilities, summary, onScanAnother }: ResultsDashboardProps) {
  return (
    <section className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summaryCards(summary).map((card) => (
          <div key={card.label} className={`rounded-2xl p-4 ${card.style}`}>
            <p className="text-xs uppercase tracking-wide opacity-90">{card.label}</p>
            <p className="mt-2 text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            downloadFile(
              "vulnerability-report.json",
              JSON.stringify({ summary, vulnerabilities }, null, 2),
              "application/json",
            )
          }
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Export as JSON
        </button>
        <button
          onClick={() => downloadFile("vulnerability-report.csv", toCsv(vulnerabilities), "text/csv")}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Export as CSV
        </button>
        <button
          onClick={onScanAnother}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500"
        >
          Scan Another
        </button>
      </div>

      {vulnerabilities.length === 0 ? (
        <div className="rounded-2xl border border-emerald-700 bg-emerald-900/30 p-6 text-emerald-200">
          No vulnerabilities found. Your dependencies are clean!
        </div>
      ) : (
        <div className="space-y-4">
          {vulnerabilities.map((vuln) => (
            <article key={`${vuln.cveId}-${vuln.packageName}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-slate-400">{vuln.cveId}</p>
                  <h3 className="text-lg font-semibold text-white">{vuln.packageName}</h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityClass[vuln.severity]}`}>
                  {vuln.severity}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  Installed version: <span className="font-semibold text-red-400">{vuln.installedVersion}</span>
                </p>
                <p>
                  Recommended fix: <span className="font-semibold text-emerald-400">{vuln.recommendedVersion ?? "N/A"}</span>
                </p>
              </div>

              <p className="mt-3 max-h-16 overflow-hidden text-sm text-slate-300">{vuln.description}</p>
              <a href={vuln.link} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-orange-400 hover:text-orange-300">
                View full details
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
