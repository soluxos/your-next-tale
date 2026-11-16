"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLibrary } from "@/components/providers/LibraryProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import StatusIcon, { statusName } from "@/components/book/StatusIcon";

// The owned state: text-shelved alone on shelved-bg read as a faint "done"
// badge, so the label is darker and the border stronger than .btn-shelved.
const OWNED = "btn-shelved border-shelved/35 text-[#1b4a2b]";
const ITEM = "cursor-pointer h-10 rounded-[6px] gap-2.5 px-2.5 label text-[12px]";

/**
 * Add a catalogue book to one of your shelves — or see / change where it is.
 *
 * Signed out: links to sign-in and brings you back here afterwards.
 * Not owned:  "Add to shelf ⌄" → pick a shelf.
 * Owned:      "On your shelf · Currently reading ⌄" → move it, add it to a
 *             custom shelf, or remove it (with a confirm).
 *
 * variant="quick" (hover cards, where a dropdown would close on pointer-out):
 * one click adds to Want to read; owned books show where they are.
 *
 * tone="quiet" draws the not-yet-shelved state as an outline button, for
 * grids where a solid black button on every card would outshout the covers.
 */
export default function AddToShelfButton({
  book,
  size = "default",
  variant = "menu",
  tone = "solid",
  className = "",
  menuClassName = ""
}) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const library = useLibrary();
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const cancelRef = useRef(null);

  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  const iconSize = size === "lg" ? 15 : size === "sm" ? 12 : 14;
  const base = cn("btn", sizeClass, className);
  const quiet = tone === "quiet";
  const action = quiet ? "btn-secondary" : "btn-primary";

  // The "Remove…" item is swapped for the confirm; put keyboard focus on the
  // safe choice rather than letting it fall back to the menu itself.
  useEffect(() => {
    if (confirmRemove) cancelRef.current?.focus();
  }, [confirmRemove]);

  // Until we know whether the book is yours, hold the button's place at its
  // final size — no "Add to shelf" flashing into "Currently reading".
  if (loading || (user && !library.ready)) {
    return (
      <span className={cn(base, "bg-paper-3 animate-pulse pointer-events-none")} aria-hidden="true">
        <span className="invisible flex items-center gap-2">
          <StatusIcon slug="add" size={iconSize} />
          {variant === "quick" ? "Want to read" : "Add to shelf"}
        </span>
      </span>
    );
  }

  if (!user) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname || "/")}`}
        className={cn(base, action)}
      >
        <StatusIcon slug="add" size={iconSize} /> Add to my shelves
      </Link>
    );
  }

  const entry = library.entryForBook(book);
  const current = library.statusShelfFor(entry);

  async function moveTo(shelf) {
    setBusy(true);
    try {
      const { alreadyThere } = await library.addBook({ book }, shelf.id);
      if (!alreadyThere) {
        toast.success(`${entry ? "Moved" : "Added"} to ${statusName(shelf)}`, {
          description: book.title
        });
      }
    } catch (e) {
      toast.error("Couldn't update your shelves", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function toggleCustom(shelf) {
    setBusy(true);
    try {
      if (entry?.shelfIds.includes(shelf.id)) {
        if (entry.shelfIds.length === 1) {
          toast("This is its only shelf", {
            description: "Use “Remove from library” to remove it completely."
          });
          return;
        }
        await library.removeFromShelf(entry, shelf.id);
        toast.success(`Removed from ${shelf.name}`);
      } else {
        await library.addBook({ book }, shelf.id);
        toast.success(`Added to ${shelf.name}`, { description: book.title });
      }
    } catch (e) {
      toast.error("Couldn't update your shelves", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function removeAll() {
    setBusy(true);
    try {
      await library.removeFromLibrary(entry);
      toast.success("Removed from your library", { description: book.title });
    } catch (e) {
      toast.error("Couldn't remove this book", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  if (variant === "quick") {
    if (entry) {
      return (
        <span className={cn(base, OWNED)}>
          <StatusIcon slug={current?.slug} size={iconSize} className="shrink-0" />
          <span className="sr-only">On your shelf:</span>
          <span className="truncate">{statusName(current) || "In your library"}</span>
        </span>
      );
    }
    const target = library.shelfById(library.defaultShelfId);
    const targetName = statusName(target) || "Want to read";
    return (
      <button
        type="button"
        disabled={busy || !target}
        onClick={(e) => {
          e.stopPropagation();
          if (target) moveTo(target);
        }}
        title={`Add to ${targetName}`}
        className={cn(base, action)}
      >
        {busy ? <Spinner size={iconSize} /> : <StatusIcon slug="add-want" size={iconSize} className="shrink-0" />}
        <span className="sr-only">Add to</span>
        <span className="truncate">{targetName}</span>
      </button>
    );
  }

  return (
    <DropdownMenu modal={false} onOpenChange={(o) => !o && setConfirmRemove(false)}>
      <DropdownMenuTrigger
        disabled={busy}
        className={cn(base, "justify-between gap-3 pr-0 text-left", entry ? OWNED : action)}
      >
        <span className="flex items-center gap-2 min-w-0">
          {busy ? (
            <Spinner size={iconSize} />
          ) : (
            <StatusIcon slug={entry ? current?.slug : "add"} size={iconSize} className="shrink-0" />
          )}
          <span className="flex flex-col items-start min-w-0">
            {/* A caption makes it read as "where it is — change it", not "done" */}
            {entry && size === "lg" ? (
              <span className="text-[10px] leading-none mb-1 text-shelved">On your shelf</span>
            ) : entry ? (
              <span className="sr-only">On your shelf:</span>
            ) : null}
            <span className="truncate max-w-full leading-tight">
              {entry ? (
                statusName(current) || "In your library"
              ) : size === "sm" ? (
                // Small buttons sit in ~165px cards on phones: "Add" fits, "Add to sh…" doesn't.
                <>
                  Add<span className="max-sm:hidden"> to shelf</span>
                </>
              ) : (
                "Add to shelf"
              )}
            </span>
          </span>
        </span>
        {/* Its own segment, so the chevron reads as "opens a menu" */}
        <span
          className={cn(
            "self-stretch flex items-center border-l",
            size === "sm" ? "px-2.5" : "px-3",
            entry ? "border-shelved/25" : quiet ? "border-line" : "border-white/20"
          )}
          aria-hidden="true"
        >
          <ChevronIcon />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn("w-64 z-[200] p-1.5 rounded-[12px]", menuClassName)}
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel className="label !text-[10px] text-textSecondary font-normal px-2.5">
          {entry ? "Status" : "Add to"}
        </DropdownMenuLabel>
        {library.statusShelves.map((shelf) => {
          const on = entry?.shelfIds.includes(shelf.id);
          return (
            <DropdownMenuItem
              key={shelf.id}
              onSelect={() => !on && moveTo(shelf)}
              className={cn(
                ITEM,
                on && "bg-shelved-bg text-[#1b4a2b] focus:bg-shelved-bg focus:text-[#1b4a2b]"
              )}
            >
              <StatusIcon slug={shelf.slug} size={14} className="shrink-0" />
              <span className="flex-1 truncate">{statusName(shelf)}</span>
              {on && (
                <>
                  <span className="sr-only">(current)</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-shelved shrink-0" aria-hidden="true" />
                </>
              )}
            </DropdownMenuItem>
          );
        })}
        {library.customShelves.length > 0 && (
          <>
            <DropdownMenuSeparator className="-mx-1.5 my-1.5 bg-line" />
            <DropdownMenuLabel className="label !text-[10px] text-textSecondary font-normal px-2.5">
              Your shelves
            </DropdownMenuLabel>
            {library.customShelves.map((shelf) => {
              const on = entry?.shelfIds.includes(shelf.id);
              return (
                <DropdownMenuItem
                  key={shelf.id}
                  role="menuitemcheckbox"
                  aria-checked={!!on}
                  onSelect={(e) => {
                    e.preventDefault();
                    toggleCustom(shelf);
                  }}
                  className={ITEM}
                >
                  <span
                    className={cn(
                      "w-3.5 h-3.5 shrink-0 rounded-[3px] border flex items-center justify-center",
                      on ? "bg-ink border-ink text-white" : "border-[#a3a3a3]"
                    )}
                    aria-hidden="true"
                  >
                    {on && <StatusIcon slug="read" size={9} strokeWidth={2.6} />}
                  </span>
                  <span className="flex-1 truncate">{shelf.name}</span>
                </DropdownMenuItem>
              );
            })}
          </>
        )}
        {entry && (
          <>
            {/* Heavier rule: the destructive action sits apart from the rest */}
            <DropdownMenuSeparator className="-mx-1.5 my-1.5 h-[2px] bg-line" />
            {confirmRemove ? (
              <div className="m-0.5 rounded-[8px] border border-[#f1c7c2] bg-[#fef3f2] p-3">
                <p className="font-ppMondwest text-[16px] leading-tight text-[#7a271a]">
                  Remove from your library?
                </p>
                <p className="mt-1 font-ppMondwest text-[14px] leading-snug text-[#b42318]">
                  Deletes your rating and review.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  <DropdownMenuItem
                    ref={cancelRef}
                    onSelect={(e) => {
                      e.preventDefault();
                      setConfirmRemove(false);
                    }}
                    className="h-8 justify-center rounded-[8px] border border-[#d6d6d6] bg-white label text-[11px] text-[#2b2b2b] cursor-pointer focus:bg-[#f1f1f1]"
                  >
                    Cancel
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={removeAll}
                    className="h-8 justify-center rounded-[8px] bg-[#d92d20] label text-[11px] text-white cursor-pointer focus:bg-[#b42318] focus:text-white"
                  >
                    Remove
                  </DropdownMenuItem>
                </div>
              </div>
            ) : (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmRemove(true);
                }}
                className={cn(ITEM, "text-[#b42318] focus:text-[#b42318] focus:bg-[#fef3f2]")}
              >
                <TrashIcon />
                Remove from library…
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9.5h6.6L12 4" />
    </svg>
  );
}
