"use client";

import { useState, useRef, useEffect } from "react";
import { SEED_GENRES } from "@/lib/books/seeder";

export default function SeedBooksPage() {
  const [selectedLabels, setSelectedLabels] = useState(
    SEED_GENRES.map((g) => g.label)
  );
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const toggleLabel = (label) => {
    setSelectedLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleRun = () => {
    setRunning(true);
    setLog([]);
    setSummary(null);
    setError(null);

    const params = new URLSearchParams();
    if (selectedLabels.length > 0) {
      params.set("genres", selectedLabels.join(","));
    }

    const eventSource = new EventSource(`/api/admin/seed-books?${params}`);

    eventSource.onmessage = (e) => {
      const payload = JSON.parse(e.data);

      if (payload.type === "progress") {
        setLog((prev) => [...prev, payload.message]);
      } else if (payload.type === "summary") {
        setSummary(payload.data);
        eventSource.close();
        setRunning(false);
      } else if (payload.type === "error") {
        setError(payload.message);
        eventSource.close();
        setRunning(false);
      }
    };

    eventSource.onerror = () => {
      setError(
        "Connection lost. The seed may still be running — check the database."
      );
      eventSource.close();
      setRunning(false);
    };
  };

  const totalTerms = selectedLabels.length;

  return (
    <div className="space-y-8">
      <div>
        <p className="font-departureMono uppercase text-[10px] text-white/40">
          Multi-Source Seeder
        </p>
        <p className="font-ppMondwest text-white text-[28px] mt-1">
          Seed Books
        </p>
        <p className="font-departureMono text-[10px] text-white/30 mt-2 max-w-lg">
          Discovers popular books via Hardcover community read counts, then
          enriches each with ISBNdb metadata.
        </p>
      </div>

      {/* Genre pills */}
      <div className="space-y-3">
        <p className="font-departureMono uppercase text-[10px] text-white/40">
          Genres
        </p>
        <div className="flex flex-wrap gap-2">
          {SEED_GENRES.map(({ label, minReaders }) => {
            const active = selectedLabels.includes(label);
            return (
              <button
                key={label}
                onClick={() => toggleLabel(label)}
                disabled={running}
                className={
                  active
                    ? "bg-white text-[#0D00FF] font-departureMono uppercase text-[11px] rounded-[8px] px-3 py-2 cursor-pointer"
                    : "border border-white/30 text-white/50 font-departureMono uppercase text-[11px] rounded-[8px] px-3 py-2 cursor-pointer hover:border-white/60 hover:text-white/80"
                }
              >
                {label}
                <span className="ml-1.5 text-[9px] opacity-50">
                  {minReaders}+ readers
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedLabels(SEED_GENRES.map((g) => g.label))}
            disabled={running}
            className="font-departureMono uppercase text-[10px] text-white/50 hover:text-white transition-colors"
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedLabels([])}
            disabled={running}
            className="font-departureMono uppercase text-[10px] text-white/50 hover:text-white transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running || totalTerms === 0}
        className="bg-white text-[#0D00FF] font-departureMono uppercase text-[12px] min-h-[48px] px-8 rounded-[8px] disabled:opacity-40 hover:bg-white/90 transition-colors"
      >
        {running
          ? "Seeding..."
          : `Run Seed (${totalTerms} genre${totalTerms !== 1 ? "s" : ""})`}
      </button>

      {/* Live log */}
      {log.length > 0 && (
        <div className="bg-black/30 border border-white/10 rounded-[8px] p-4 h-96 overflow-y-auto font-mono text-[11px] text-white/70 space-y-0.5">
          {log.map((line, i) => (
            <div key={i} className="leading-relaxed">
              <span className="text-white/30 mr-2 select-none">
                {String(i + 1).padStart(3, "0")}
              </span>
              {line}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-400 bg-red-900/20 border border-red-500/20 rounded-[8px] px-4 py-3 font-departureMono text-[11px]">
          {error}
        </p>
      )}

      {/* Summary */}
      {summary && (
        <div className="border border-white/10 rounded-[8px] p-6 space-y-3">
          <p className="font-departureMono uppercase text-[11px] text-white/40">
            Seed Complete
          </p>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["Genres Queried", summary.genresQueried],
              ["Total Discovered", summary.totalDiscovered],
              ["Already in DB", summary.alreadyInDb],
              ["Processed", summary.processed],
              ["Inserted", summary.inserted],
              ["Cover Failures", summary.coverFailures],
              ["Incomplete", summary.incompleteBooks],
              ...(summary.failed > 0 ? [["Failed", summary.failed]] : [])
            ].map(([label, value]) => (
              <div key={label}>
                <p className="font-departureMono uppercase text-[10px] text-white/40">
                  {label}
                </p>
                <p className="font-ppMondwest text-white text-[28px] leading-none mt-1">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
