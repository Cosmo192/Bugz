"use client";

import { useMemo, useState } from "react";

interface GitHubURLInputProps {
  onSubmit: (url: string) => void;
  disabled?: boolean;
}

interface FileUploadZoneProps {
  onSubmit: (files: File[]) => void;
  disabled?: boolean;
}

const GITHUB_REPO_REGEX = /^https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/;

export function GitHubURLInput({ onSubmit, disabled = false }: GitHubURLInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isValid = useMemo(() => GITHUB_REPO_REGEX.test(url.trim()), [url]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = url.trim();

    if (!GITHUB_REPO_REGEX.test(trimmed)) {
      setError("Please enter a valid GitHub repo URL (https://github.com/user/repo).");
      return;
    }

    setError(null);
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm font-medium text-slate-300">GitHub Repository URL</label>
      <input
        type="url"
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
          if (error) setError(null);
        }}
        placeholder="https://github.com/user/repo"
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none ring-orange-500 transition focus:ring-2"
        disabled={disabled}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!error && url && !isValid && <p className="text-sm text-amber-400">URL format looks incomplete.</p>}
      <button
        type="submit"
        disabled={disabled || !isValid}
        className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Scan Repository
      </button>
    </form>
  );
}

export function FileUploadZone({ onSubmit, disabled = false }: FileUploadZoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const allowedExtensions = [".json", ".txt", ".toml", ".zip"];

  const validate = (files: File[]) => {
    const invalid = files.find((file) => {
      const lower = file.name.toLowerCase();
      return !allowedExtensions.some((ext) => lower.endsWith(ext));
    });

    if (invalid) {
      setError(`Unsupported file type: ${invalid.name}`);
      return false;
    }

    setError(null);
    return true;
  };

  const handleFiles = (files: File[]) => {
    if (!files.length) return;
    if (validate(files)) {
      setSelectedFiles(files);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFiles(Array.from(event.dataTransfer.files));
        }}
        className="rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/50 p-8 text-center"
      >
        <p className="text-sm text-slate-300">Drag and drop dependency files here</p>
        <p className="mt-1 text-xs text-slate-500">Accepted: .json, .txt, .toml, .zip</p>
        <input
          type="file"
          multiple
          accept=".json,.txt,.toml,.zip"
          disabled={disabled}
          onChange={(event) => handleFiles(Array.from(event.target.files ?? []))}
          className="mt-4 block w-full cursor-pointer text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-100 hover:file:bg-slate-700"
        />
      </div>

      {selectedFiles.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
          <p className="font-medium text-slate-200">Selected files:</p>
          <ul className="mt-2 space-y-1">
            {selectedFiles.map((file) => (
              <li key={`${file.name}-${file.size}`} className="truncate">
                {file.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        disabled={disabled || selectedFiles.length === 0}
        onClick={() => onSubmit(selectedFiles)}
        className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Upload & Scan
      </button>
    </div>
  );
}
