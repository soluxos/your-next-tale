"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
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
  onDeleteRedirect
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
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-ppMondwest text-xl">
            Manage Shelves
          </SheetTitle>
          <SheetDescription className="font-departureMono uppercase text-[10px] text-textSecondary">
            Drag to reorder. The first shelf is your default view.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {error && (
            <p className="font-departureMono text-[10px] text-red-500">
              {error}
            </p>
          )}

          {localShelves.map((shelf, index) => (
            <div
              key={shelf.id}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 p-3 rounded-[8px] border border-border
                          bg-white cursor-grab active:cursor-grabbing transition-opacity
                          ${dragIndex === index ? "opacity-40" : "opacity-100"}
                          ${dragOverIndex === index ? "border-t-2 border-t-textPrimary" : ""}`}
            >
              {/* Drag handle */}
              <div className="text-textSecondary shrink-0 cursor-grab">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="9" cy="5" r="1" />
                  <circle cx="9" cy="12" r="1" />
                  <circle cx="9" cy="19" r="1" />
                  <circle cx="15" cy="5" r="1" />
                  <circle cx="15" cy="12" r="1" />
                  <circle cx="15" cy="19" r="1" />
                </svg>
              </div>

              {/* Shelf name — inline rename for custom shelves */}
              {confirmDeleteId === shelf.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <p className="font-departureMono uppercase text-[10px] text-red-600 flex-1">
                    Delete &ldquo;{shelf.name}&rdquo;?
                  </p>
                  <button
                    onClick={() => handleDeleteConfirm(shelf.id)}
                    className="h-7 px-2 font-departureMono uppercase text-[10px] bg-red-500 text-white rounded-[6px] hover:bg-red-600 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="h-7 px-2 font-departureMono uppercase text-[10px] border border-border rounded-[6px] hover:bg-[#f4f4f4] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : editingId === shelf.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRename(shelf.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(shelf.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 font-departureMono text-[12px] border-b border-textPrimary
                             bg-transparent outline-none py-0.5"
                />
              ) : (
                <span className="flex-1 font-departureMono uppercase text-[12px]">
                  {shelf.name}
                </span>
              )}

              {/* Default badge */}
              {shelf.is_default && confirmDeleteId !== shelf.id && (
                <span className="font-departureMono uppercase text-[9px] px-2 py-0.5 bg-[#f4f4f4] text-textSecondary rounded-[6px] shrink-0">
                  Default
                </span>
              )}

              {/* Edit/delete — custom shelves only */}
              {!shelf.is_default && confirmDeleteId !== shelf.id && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setEditingId(shelf.id);
                      setEditingName(shelf.name);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-[#f4f4f4] transition-colors"
                    aria-label="Rename shelf"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(shelf.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-red-50 text-textSecondary hover:text-red-500 transition-colors"
                    aria-label="Delete shelf"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Default view toggle — all shelves, when not in confirm-delete state */}
              {confirmDeleteId !== shelf.id && editingId !== shelf.id && (
                <div className="flex items-center gap-1 shrink-0 border-l border-border pl-2 ml-1">
                  {["books", "reviews"].map((v) => (
                    <button
                      key={v}
                      onClick={() => handleSetDefaultView(shelf.id, v)}
                      className={`
                        font-departureMono uppercase text-[8px] px-2 h-[22px] rounded-[4px]
                        transition-colors
                        ${
                          (shelf.default_view || "books") === v
                            ? "bg-[#1f1f1f] text-white"
                            : "bg-[#f4f4f4] text-textSecondary hover:bg-[#e8e8e8]"
                        }
                      `}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Create new shelf */}
        <div className="mt-4 pt-4 border-t border-border">
          <p className="font-departureMono uppercase text-[10px] text-textSecondary mb-2">
            New Shelf
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newShelfName}
              onChange={(e) => setNewShelfName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Shelf name..."
              className="flex-1 border border-border rounded-[8px] px-3 h-9
                         font-departureMono text-[12px] bg-transparent
                         focus:outline-none focus:ring-1 focus:ring-textPrimary
                         placeholder:text-textSecondary"
            />
            <button
              onClick={handleCreate}
              disabled={!newShelfName.trim() || creating}
              className="h-9 px-4 font-departureMono uppercase text-[11px]
                         bg-[#1f1f1f] text-white rounded-[8px] hover:bg-[#353535]
                         transition-colors disabled:opacity-40"
            >
              {creating ? "..." : "Add"}
            </button>
          </div>
          {createError && (
            <p className="font-departureMono text-[10px] text-red-500 mt-1">
              {createError}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
