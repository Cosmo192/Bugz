"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import ResultsDashboard from "@/components/ResultsDashboard";
import { FileUploadZone, GitHubURLInput } from "@/components/ScanForm";
import type { Vulnerability } from "@/lib/osvClient";

interface Summary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface ScanResponse {
  vulnerabilities: Vulnerability[];
  summary: Summary;
  executionTimeMs?: number;
  parseErrors?: string[];
  message?: string;
}

type Tab = "url" | "upload";

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_KEY = "bug-bounty-finder:last-scan";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("url");
  const [isLoading, setIsLoading] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { cachedAt: number; data: ScanResponse };
      if (Date.now() - parsed.cachedAt <= CACHE_TTL_MS) {
        setScanResults(parsed.data);
      }
    } catch {
      localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  const tabs = useMemo(
    () => [
      { key: "url" as const, label: "Scan GitHub URL" },
      { key: "upload" as const, label: "Upload Files" },
    ],
    [],
  );

  const saveCache = (data: ScanResponse) => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data }));
  };

  const handleUrlScan = async (url: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/scan-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Scan failed.");
      }

      setScanResults(data);
      saveCache(data);
    } catch (scanError) {
      setError((scanError as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadScan = async (files: File[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch("/api/scan-upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Upload scan failed.");
      }

      setScanResults(data);
      saveCache(data);
    } catch (scanError) {
      setError((scanError as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">"Bugz" A Bug Finder - Automated Vulnerability Scanner</h1>
        <p className="text-slate-300">
          Scan GitHub repos or upload files to find security vulnerabilities instantly.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setError(null);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key ? "bg-orange-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "url" ? (
          <GitHubURLInput onSubmit={handleUrlScan} disabled={isLoading} />
        ) : (
          <FileUploadZone onSubmit={handleUploadScan} disabled={isLoading} />
        )}
      </section>

      {error && (
        <div className="mt-6 rounded-xl border border-red-700 bg-red-900/30 p-4 text-sm text-red-200">
          {error} If this is a GitHub URL, double-check that the repository exists and is public.
        </div>
      )}

      {isLoading && <div className="mt-6"><LoadingSpinner /></div>}

      {scanResults && !isLoading && (
        <div className="mt-8 space-y-4">
          {scanResults.parseErrors && scanResults.parseErrors.length > 0 && (
            <div className="rounded-xl border border-amber-600/40 bg-amber-900/20 p-4 text-sm text-amber-200">
              <p className="font-semibold">Some files could not be parsed:</p>
              <ul className="mt-2 list-disc pl-5">
                {scanResults.parseErrors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {scanResults.executionTimeMs !== undefined && (
            <p className="text-xs text-slate-400">Execution time: {(scanResults.executionTimeMs / 1000).toFixed(2)}s</p>
          )}

          <ResultsDashboard
            vulnerabilities={scanResults.vulnerabilities}
            summary={scanResults.summary}
            onScanAnother={() => {
              setScanResults(null);
              setError(null);
            }}
          />
        </div>
      )}
    </main>
  );
}
