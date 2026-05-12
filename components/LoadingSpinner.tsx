interface LoadingSpinnerProps {
  progress?: number;
}

export default function LoadingSpinner({ progress }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/80 p-8">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-orange-500" />
      <p className="mt-4 text-sm text-slate-300">Scanning for vulnerabilities...</p>
      {typeof progress === "number" && (
        <p className="mt-1 text-xs text-slate-500">Progress: {Math.max(0, Math.min(100, progress)).toFixed(0)}%</p>
      )}
    </div>
  );
}
