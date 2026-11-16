"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import {
  createShelf,
  renameShelf,
  deleteShelf,
  updateShelfOrder,
  updateShelfDefaultView
} from "@/lib/bookshelves";

export default function ManageShelvesPanel({
  open,
  onOpenChange,
  shelves,
  userId,
  onShelvesUpdated,
  currentShelfSlug,
  onDeleteRedirect,
  onRenameRedirect,
  shelfCounts
}) {
  const supabase = createClient();
  const [localShelves, setLocalShelves] = useState(shelves);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [newShelfName, setNewShelfName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [error, setError] = useState(null);
  // Rename / Delete from a shelf's menu move focus into the row; stop the
  // menu handing it back to its trigger as it closes (which would blur the
  // rename field and cancel it).
  const keepFocusRef = useRef(false);

  useEffect(() => {
    setLocalShelves(shelves);
  }, [shelves]);

  // --- Drag and drop ---
  const handleDragStart = (e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) return;
    const updated = [...localShelves];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setLocalShelves(updated);
    setDragIndex(null);
    setDragOverIndex(null);
    saveOrder(updated);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const saveOrder = async (ordered) => {
    setError(null);
    try {
      await updateShelfOrder(
        supabase,
        ordered.map((s) => s.id)
      );
      onShelvesUpdated(ordered);
    } catch (e) {
      console.error("Error saving shelf order:", e);
      setError("Failed to save order. Please try again.");
      setLocalShelves(shelves);
    }
  };

  // --- Rename ---
  const handleRename = async (shelfId) => {
    const trimmed = editingName.trim();
    const original = localShelves.find((s) => s.id === shelfId);
    if (!trimmed || trimmed === original?.name) {
      setEditingId(null);
      return;
    }
    setError(null);
    try {
      const updated = await renameShelf(supabase, shelfId, trimmed);
      const next = localShelves.map((s) =>
        s.id === shelfId ? { ...s, name: updated.name, slug: updated.slug } : s
      );
      setLocalShelves(next);
      onShelvesUpdated(next);
      setEditingId(null);
      if (original?.slug === currentShelfSlug && updated.slug !== original.slug) {
        onRenameRedirect?.(updated.slug);
      }
    } catch (e) {
      console.error("Error renaming shelf:", e);
      setError(e.message || "Failed to rename shelf.");
    }
  };

  // --- Delete ---
  const handleDeleteConfirm = async (shelfId) => {
    setError(null);
    const deleted = localShelves.find((s) => s.id === shelfId);
    try {
      await deleteShelf(supabase, shelfId);
      const remaining = localShelves.filter((s) => s.id !== shelfId);
      setLocalShelves(remaining);
      onShelvesUpdated(remaining);
      setConfirmDeleteId(null);

      if (deleted?.slug === currentShelfSlug) {
        onDeleteRedirect?.(remaining);
      }
    } catch (e) {
      console.error("Error deleting shelf:", e);
      setError(e.message || "Failed to delete shelf.");
      setConfirmDeleteId(null);
    }
  };

  // --- Create ---
  const handleCreate = async () => {
    const trimmed = newShelfName.trim();
    if (!trimmed) return;
    const duplicate = localShelves.some(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setCreateError("A shelf with that name already exists");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createShelf(supabase, userId, { name: trimmed });
      const next = [...localShelves, created];
      setLocalShelves(next);
      onShelvesUpdated(next);
      setNewShelfName("");
    } catch (e) {
      console.error("Error creating shelf:", e);
      setCreateError(e.message || "Failed to create shelf.");
    } finally {
      setCreating(false);
    }
  };

  const handleSetDefaultView = async (shelfId, view) => {
    try {
      await updateShelfDefaultView(supabase, shelfId, userId, view);
      const next = localShelves.map((s) =>
        s.id === shelfId ? { ...s, default_view: view } : s
      );
      setLocalShelves(next);
      onShelvesUpdated(next);
    } catch (e) {
      console.error("Failed to set default view:", e);
      setError("Couldn't change how this shelf opens. Please try again.");
    }
  };

  const moveShelf = (index, delta) => {
    const to = index + delta;
    if (to < 0 || to >= localShelves.length) return;
    const updated = [...localShelves];
    const [moved] = updated.splice(index, 1);
    updated.splice(to, 0, moved);
    setLocalShelves(updated);
    saveOrder(updated);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-paper">
        <SheetHeader className="text-left">
          <SheetTitle className="font-ppMondwest text-[26px] leading-none text-ink">
            Manage shelves
          </SheetTitle>
          <SheetDescription className="font-ppMondwest text-[15px] leading-snug text-textSecondary">
            Drag (or use the arrows) to reorder your tabs. The ⋯ menu on a shelf sets whether it
            opens on covers or reviews, and renames or deletes your own shelves.
          </SheetDescription>
        </SheetHeader>

        {error && (
          <p role="alert" className="mt-4 label text-[#b42318]">
            {error}
          </p>
        )}

        <ul className="mt-5 flex flex-col gap-2">
          {localShelves.map((shelf, index) => {
            const count = shelfCounts ? shelfCounts[shelf.id] ?? 0 : undefined;
            const confirming = confirmDeleteId === shelf.id;
            const editing = editingId === shelf.id;
            return (
              <li
                key={shelf.id}
                draggable={!editing && !confirming}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`card p-3 transition-opacity
                            ${dragIndex === index ? "opacity-40" : "opacity-100"}
                            ${dragOverIndex === index && dragIndex !== index ? "ring-2 ring-ink" : ""}`}
              >
                {confirming ? (
                  <div className="flex flex-col gap-3">
                    <p className="font-ppMondwest text-[16px] leading-snug text-ink">
                      Delete &ldquo;{shelf.name}&rdquo;?
                    </p>
                    <p className="font-ppMondwest text-[14px] leading-snug text-textSecondary -mt-2">
                      This removes the shelf only.
                      {count
                        ? ` Its ${count} ${count === 1 ? "book stays" : "books stay"} in your library with their status, rating and review.`
                        : " It has no books on it."}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        autoFocus
                        onClick={() => handleDeleteConfirm(shelf.id)}
                        className="btn btn-sm h-10 sm:h-8 btn-danger-solid"
                      >
                        Delete shelf
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="btn btn-sm h-10 sm:h-8 btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-textSecondary shrink-0 cursor-grab active:cursor-grabbing hidden sm:block" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="9" cy="5" r="1.5" />
                          <circle cx="9" cy="12" r="1.5" />
                          <circle cx="9" cy="19" r="1.5" />
                          <circle cx="15" cy="5" r="1.5" />
                          <circle cx="15" cy="12" r="1.5" />
                          <circle cx="15" cy="19" r="1.5" />
                        </svg>
                      </span>

                      {editing ? (
                        <input
                          autoFocus
                          aria-label={`Rename ${shelf.name}`}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleRename(shelf.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(shelf.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="field flex-1 min-w-0 sm:h-9"
                        />
                      ) : (
                        <div className="flex-1 min-w-0">
                          <p className="font-ppMondwest text-[18px] leading-tight text-ink truncate">
                            {shelf.name}
                          </p>
                          <p className="label text-textSecondary mt-0.5">
                            {/* Status shelves hold each book once; custom ones work like tags */}
                            {shelf.is_default ? "Reading status" : "Custom shelf"}
                            {typeof count === "number" && ` · ${count} ${count === 1 ? "book" : "books"}`}
                            {shelf.default_view === "reviews" && " · Opens on reviews"}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-0.5 shrink-0">
                        <IconButton
                          label={`Move ${shelf.name} up`}
                          disabled={index === 0}
                          onClick={() => moveShelf(index, -1)}
                        >
                          <path d="M6 15l6-6 6 6" />
                        </IconButton>
                        <IconButton
                          label={`Move ${shelf.name} down`}
                          disabled={index === localShelves.length - 1}
                          onClick={() => moveShelf(index, 1)}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </IconButton>
                        {!editing && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={`More options for ${shelf.name}`}
                              title="More options"
                              className={`${ICON_BUTTON} data-[state=open]:bg-paper-3 data-[state=open]:text-ink`}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <circle cx="5" cy="12" r="1.8" />
                                <circle cx="12" cy="12" r="1.8" />
                                <circle cx="19" cy="12" r="1.8" />
                              </svg>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              sideOffset={4}
                              className="w-52 p-1.5 rounded-[12px] z-[60]"
                              onCloseAutoFocus={(e) => {
                                if (keepFocusRef.current) e.preventDefault();
                                keepFocusRef.current = false;
                              }}
                            >
                              <DropdownMenuLabel className="label !text-[10px] text-textSecondary font-normal pl-8">
                                Opens on
                              </DropdownMenuLabel>
                              <DropdownMenuRadioGroup
                                value={shelf.default_view || "books"}
                                onValueChange={(v) => handleSetDefaultView(shelf.id, v)}
                              >
                                <DropdownMenuRadioItem value="books" className="label h-10 rounded-[6px] cursor-pointer">
                                  Covers
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="reviews" className="label h-10 rounded-[6px] cursor-pointer">
                                  Reviews
                                </DropdownMenuRadioItem>
                              </DropdownMenuRadioGroup>
                              {!shelf.is_default && (
                                <>
                                  <DropdownMenuSeparator className="bg-line" />
                                  <DropdownMenuItem
                                    className="label h-10 pl-8 rounded-[6px] cursor-pointer"
                                    onSelect={() => {
                                      keepFocusRef.current = true;
                                      setEditingId(shelf.id);
                                      setEditingName(shelf.name);
                                    }}
                                  >
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="label h-10 pl-8 rounded-[6px] cursor-pointer text-[#b42318] focus:bg-[#fef3f2] focus:text-[#b42318]"
                                    onSelect={() => {
                                      keepFocusRef.current = true;
                                      setConfirmDeleteId(shelf.id);
                                    }}
                                  >
                                    Delete shelf…
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        {/* Create new shelf */}
        <form
          className="mt-6 pt-5 border-t border-line"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <label htmlFor="new-shelf" className="label text-textSecondary block mb-2">
            New shelf
          </label>
          <div className="flex gap-2">
            <input
              id="new-shelf"
              type="text"
              value={newShelfName}
              onChange={(e) => {
                setNewShelfName(e.target.value);
                if (createError) setCreateError(null);
              }}
              placeholder="e.g. Summer 2026, Book club, Favourites"
              className="field flex-1 min-w-0"
              aria-describedby="new-shelf-help"
            />
            <button
              type="submit"
              disabled={!newShelfName.trim() || creating}
              className="btn btn-primary"
            >
              {creating ? "Adding…" : "Add shelf"}
            </button>
          </div>
          <p id="new-shelf-help" className="font-ppMondwest text-[14px] text-textSecondary mt-2 leading-snug">
            Your own shelves work like tags — a book can sit on as many as you like, alongside its
            status.
          </p>
          {createError && (
            <p role="alert" className="label text-[#b42318] mt-2">
              {createError}
            </p>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}

// 40px tap targets on phones, a touch tighter where there's a mouse.
const ICON_BUTTON =
  "w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center rounded-[8px] text-textSecondary transition-colors hover:bg-paper-3 hover:text-ink disabled:opacity-30 disabled:pointer-events-none";

function IconButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={ICON_BUTTON}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}
