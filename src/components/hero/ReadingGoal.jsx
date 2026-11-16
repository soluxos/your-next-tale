"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLibrary } from "@/components/providers/LibraryProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Goals live in profiles.ui_settings.reading_goals as { "2026": 24 }, so no
// schema change is needed and each year keeps its own target.

function pace(done, target, now = new Date()) {
  const start = new Date(now.getFullYear(), 0, 1).getTime();
  const end = new Date(now.getFullYear() + 1, 0, 1).getTime();
  const expected = Math.floor(((now.getTime() - start) / (end - start)) * target);
  const diff = done - expected;
  if (done >= target) return { tone: "done", text: "Goal reached" };
  if (diff >= 1) return { tone: "ahead", text: `${diff} ahead of pace` };
  if (diff <= -1) return { tone: "behind", text: `${-diff} behind pace` };
  return { tone: "on", text: "On pace" };
}

/**
 * Home hero: books finished this year, against the goal if there is one,
 * with pace. Tapping it sets or edits the goal in place.
 */
export default function ReadingGoal({ className }) {
  const { user, profile, updateUISettings } = useAuth();
  const library = useLibrary();
  const supabase = useMemo(() => createClient(), []);
  const year = new Date().getFullYear();
  const goals = profile?.ui_settings?.reading_goals || {};
  const target = Number(goals[year]) || 0;
  const [done, setDone] = useState(null);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  // Finishing a book anywhere moves the count.
  useEffect(() => library.subscribe(() => setVersion((v) => v + 1)), [library.subscribe]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("user_books")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("date_finished", `${year}-01-01`)
      .lt("date_finished", `${year + 1}-01-01`)
      .then(({ count }) => !cancelled && setDone(count || 0));
    return () => {
      cancelled = true;
    };
  }, [supabase, user, year, version]);

  const save = async (e) => {
    e?.preventDefault();
    const n = Math.max(0, Math.min(999, parseInt(draft, 10) || 0));
    const next = { ...goals };
    if (n) next[year] = n;
    else delete next[year];
    setOpen(false);
    await updateUISettings({ reading_goals: next });
  };

  const openEditor = (o) => {
    setOpen(o);
    if (o) {
      setDraft(target ? String(target) : "");
      setTimeout(() => inputRef.current?.select(), 30);
    }
  };

  if (!user) return null;
  if (done === null) {
    return (
      <div className={className} aria-hidden="true">
        <span className="block h-3 w-28 rounded bg-paper-2 animate-pulse" />
        <span className="mt-3 block h-6 w-44 rounded bg-paper-2 animate-pulse" />
      </div>
    );
  }

  const books = (n) => `${n} ${n === 1 ? "book" : "books"}`;
  const p = target ? pace(done, target) : null;
  const pct = target ? Math.min(100, Math.round((done / target) * 100)) : 0;

  return (
    <Popover open={open} onOpenChange={openEditor}>
      <PopoverTrigger
        className={cn("group block w-full text-left rounded-[6px] focus-ring", className)}
        aria-label={
          target
            ? `${year} reading goal: ${done} of ${target} books, ${p.text.toLowerCase()}. Edit goal`
            : `${books(done)} read in ${year}. Set a reading goal`
        }
      >
        <span className="flex items-baseline justify-between gap-4">
          <span className="label text-textSecondary">{target ? `${year} reading goal` : `Read in ${year}`}</span>
          <span className="label text-textPrimary group-hover:text-ink transition-colors inline-flex items-center gap-1.5">
            {target ? "Edit" : <><Flag /> Set a goal</>}
          </span>
        </span>
        <span className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-ppMondwest text-ink text-[24px] sm:text-[26px] leading-none tabular-nums">
            {target ? (
              <>
                {done} <span className="text-textSecondary">of {books(target)}</span>
              </>
            ) : (
              `${books(done)} so far`
            )}
          </span>
          {p && (
            <span
              className={cn(
                "label whitespace-nowrap",
                p.tone === "behind" ? "text-[#9a3412]" : p.tone === "on" ? "text-textSecondary" : "text-shelved"
              )}
            >
              {p.text}
            </span>
          )}
        </span>
        {target > 0 && (
          <span className="mt-4 block h-[4px] rounded-full bg-paper-3 overflow-hidden" aria-hidden="true">
            <span className="block h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={10} className="w-72 p-4 rounded-[12px] z-[60]">
        <form onSubmit={save} className="space-y-3">
          <label htmlFor="goal-input" className="block font-ppMondwest text-[18px] text-ink leading-tight">
            How many books in {year}?
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="goal-input"
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="field flex-1 tabular-nums"
              placeholder="24"
            />
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
          <p className="text-[12.5px] text-textSecondary">
            {done} finished so far this year.{target ? " Set 0 to remove the goal." : ""}
          </p>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function Flag() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 22V4M4 4h12l-2 4 2 4H4" />
    </svg>
  );
}
