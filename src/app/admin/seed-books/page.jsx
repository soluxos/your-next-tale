"use client";

import { useState, useRef, useEffect } from "react";
import { DEFAULT_SUBJECT_TERMS } from "@/lib/books/seeder";

export default function SeedBooksPage() {
  const [selectedTerms, setSelectedTerms] = useState([
    ...DEFAULT_SUBJECT_TERMS
  ]);
  const [customTerms, setCustomTerms] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const logEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const toggleTerm = (term) => {
    setSelectedTerms((prev) =>
      prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term]
    );
  };

  const addCustomTerm = (raw) => {
    const term = raw.trim().toLowerCase().replace(/,+$/, "");
    if (!term) return;
    if (!customTerms.includes(term)) {
      setCustomTerms((prev) => [...prev, term]);
    }
    if (!selectedTerms.includes(term)) {
      setSelectedTerms((prev) => [...prev, term]);
    }
    setInputValue("");
  };

  const removeCustomTerm = (term) => {
    setCustomTerms((prev) => prev.filter((t) => t !== term));
    setSelectedTerms((prev) => prev.filter((t) => t !== term));
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCustomTerm(inputValue);
    } else if (
      e.key === "Backspace" &&
      inputValue === "" &&
      customTerms.length > 0
    ) {
      removeCustomTerm(customTerms[customTerms.length - 1]);
    }
  };

  const handleRun = () => {
    setRunning(true);
    setLog([]);
    setSummary(null);
    setError(null);

    const params = new URLSearchParams({
      terms: selectedTerms.join(",")
    });

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

  return (
    <div className="space-y-8">
      <div>
        <p className="font-departureMono uppercase text-[10px] text-white/40">
          ISBNdb Subject Seeder
        </p>
        <p className="font-ppMondwest text-white text-[28px] mt-1">
          Seed Books
        </p>
      </div>

      {/* Preset term pills */}
      <div className="space-y-3">
        <p className="font-departureMono uppercase text-[10px] text-white/40">
          Preset Genres
        </p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_SUBJECT_TERMS.map((term) => {
            const active = selectedTerms.includes(term);
            return (
              <button
                key={term}
                onClick={() => toggleTerm(term)}
                disabled={running}
                className={
                  active
                    ? "bg-white text-[#0D00FF] font-departureMono uppercase text-[11px] rounded-[8px] px-3 py-2 cursor-pointer"
                    : "border border-white/30 text-white/50 font-departureMono uppercase text-[11px] rounded-[8px] px-3 py-2 cursor-pointer hover:border-white/60 hover:text-white/80"
                }
              >
                {term}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              setSelectedTerms([...DEFAULT_SUBJECT_TERMS, ...customTerms])
            }
            disabled={running}
            className="font-departureMono uppercase text-[10px] text-white/50 hover:text-white transition-colors"
          >
            Select All
          </button>
          <button
            onClick={() => setSelectedTerms([])}
            disabled={running}
            className="font-departureMono uppercase text-[10px] text-white/50 hover:text-white transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Custom genre tag input */}
      <div className="space-y-3">
        <p className="font-departureMono uppercase text-[10px] text-white/40">
          Custom Genres
        </p>
        <div
          onClick={() => inputRef.current?.focus()}
          className="min-h-[48px] flex flex-wrap gap-2 items-center border border-white/20 rounded-[8px] px-3 py-2 cursor-text bg-white/5 focus-within:border-white/50 transition-colors"
        >
          {customTerms.map((term) => (
            <span
              key={term}
              className="flex items-center gap-1.5 bg-white/10 border border-white/20 text-white font-departureMono uppercase text-[11px] rounded-[6px] px-2.5 py-1"
            >
              {term}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCustomTerm(term);
                }}
                disabled={running}
                className="text-white/40 hover:text-white transition-colors leading-none"
                aria-label={`Remove ${term}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            onBlur={() => {
              if (inputValue.trim()) addCustomTerm(inputValue);
            }}
            disabled={running}
            placeholder={
              customTerms.length === 0 ? "Type a genre and press Enter…" : ""
            }
            className="flex-1 min-w-[180px] bg-transparent outline-none font-departureMono uppercase text-[11px] text-white placeholder-white/30 disabled:opacity-40"
          />
        </div>
        <p className="font-departureMono text-[10px] text-white/30">
          Press Enter or comma to add. Backspace to remove the last tag.
        </p>
      </div>

      {/* Selected summary */}
      {selectedTerms.length > 0 && (
        <p className="font-departureMono text-[10px] text-white/40">
          {selectedTerms.length} term{selectedTerms.length !== 1 ? "s" : ""}{" "}
          selected: {selectedTerms.join(", ")}
        </p>
      )}

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running || selectedTerms.length === 0}
        className="bg-white text-[#0D00FF] font-departureMono uppercase text-[12px] min-h-[48px] px-8 rounded-[8px] disabled:opacity-40 hover:bg-white/90 transition-colors"
      >
        {running ? "Seeding..." : `Run Seed (${selectedTerms.length} terms)`}
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
              ["Fetched", summary.totalFetched],
              ["Unique", summary.uniqueAfterDedup],
              ["Already in DB", summary.alreadyInDb],
              ["Inserted", summary.inserted],
              ["Cover Failures", summary.coverFailures],
              ["Incomplete", summary.incompleteBooks],
              ...(summary.failed > 0
                ? [["Failed (skipped)", summary.failed]]
                : [])
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
