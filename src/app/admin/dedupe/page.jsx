"use client";

import { useState } from "react";

export default function DedupePage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/deduplicate", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Request failed");
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="font-departureMono uppercase text-[10px] text-white/40">
          Maintenance
        </p>
        <p className="font-ppMondwest text-white text-[28px] mt-1">
          Fix Duplicates
        </p>
        <p className="font-departureMono text-[10px] text-white/30 mt-2 max-w-lg">
          Finds duplicate books by normalised title + first author name. Keeps
          the highest-quality record and reassigns user_books references before
          deleting duplicates.
        </p>
      </div>

      <button
        onClick={handleRun}
        disabled={running}
        className="bg-white text-[#0D00FF] font-departureMono uppercase text-[12px] min-h-[48px] px-8 rounded-[8px] disabled:opacity-40 hover:bg-white/90 transition-colors"
      >
        {running ? "Running..." : "Run Deduplication"}
      </button>

      {error && (
        <p className="text-red-400 bg-red-900/20 border border-red-500/20 rounded-[8px] px-4 py-3 font-departureMono text-[11px]">
          {error}
        </p>
      )}

      {result && (
        <div className="border border-white/10 rounded-[8px] p-6 space-y-3">
          <p className="font-departureMono uppercase text-[11px] text-white/40">
            Deduplication Complete
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-departureMono uppercase text-[10px] text-white/40">
                Groups Merged
              </p>
              <p className="font-ppMondwest text-white text-[28px] leading-none mt-1">
                {result.mergedGroups}
              </p>
            </div>
            <div>
              <p className="font-departureMono uppercase text-[10px] text-white/40">
                Records Deleted
              </p>
              <p className="font-ppMondwest text-white text-[28px] leading-none mt-1">
                {result.deletedCount}
              </p>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="font-departureMono uppercase text-[10px] text-red-400/60">
                Errors
              </p>
              <div className="bg-black/30 border border-white/10 rounded-[8px] p-3 max-h-48 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <p
                    key={i}
                    className="font-mono text-[10px] text-red-400/70 leading-relaxed"
                  >
                    {err}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
