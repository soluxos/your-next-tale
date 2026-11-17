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
 * Home hero: one quiet line with the books finished this year, against the
 * goal and its pace if there is one ("7 of 24 books in 2026 · On pace"), else
 * an invitation to set one. Tapping it sets or edits the goal in place.
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
    return <span className={cn("inline-block h-4 w-44 rounded bg-paper-2 animate-pulse", className)} aria-hidden="true" />;
  }

  const books = (n) => `${n} ${n === 1 ? "book" : "books"}`;
  const p = target ? pace(done, target) : null;

  return (
    <Popover open={open} onOpenChange={openEditor}>
      <PopoverTrigger
        className={cn(
          "group inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-left text-[14px] leading-snug text-textSecondary rounded-[4px] focus-ring",
          className
        )}
        title={target ? "Edit your reading goal" : undefined}
        aria-label={
          target
            ? `${year} reading goal: ${done} of ${target} books, ${p.text.toLowerCase()}. Edit goal`
            : `${books(done)} read in ${year}. Set a reading goal`
        }
      >
        <span>
          <span className="text-ink tabular-nums">{target ? `${done} of ${target}` : done}</span>{" "}
          {target ? `books in ${year}` : `${done === 1 ? "book" : "books"} read in ${year}`}
        </span>
        <span aria-hidden="true" className="opacity-50">·</span>
        {p ? (
          <span
            className={cn(
              "whitespace-nowrap",
              p.tone === "behind" ? "text-[#9a3412]" : p.tone === "on" ? "text-textSecondary" : "text-shelved"
            )}
          >
            {p.text}
          </span>
        ) : (
          <span className="whitespace-nowrap text-textPrimary underline decoration-1 underline-offset-[3px] decoration-black/25 group-hover:text-ink group-hover:decoration-ink transition-colors">
            Set a goal
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
