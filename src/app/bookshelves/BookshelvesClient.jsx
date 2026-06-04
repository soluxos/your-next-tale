// Safe to delete once /u/[username] is confirmed working
"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createShelf,
  deleteShelf,
  renameShelf,
  updateShelfOrder
} from "@/lib/bookshelves";
import Link from "next/link";

export default function BookshelvesClient({ shelves: initialShelves, userId }) {
  const supabase = createClient();
  const [shelves, setShelves] = useState(initialShelves);
  const [newShelfName, setNewShelfName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    if (!newShelfName.trim()) return;
    setError(null);
    try {
      const shelf = await createShelf(supabase, userId, {
        name: newShelfName.trim()
      });
      setShelves((prev) => [...prev, { ...shelf, books: [] }]);
      setNewShelfName("");
    } catch (e) {
      setError(e.message || "Error creating shelf");
    }
  };

  const handleDelete = async (shelfId, isDefault) => {
    if (isDefault) return;
    setError(null);
    try {
      await deleteShelf(supabase, shelfId);
      setShelves((prev) => prev.filter((s) => s.id !== shelfId));
    } catch (e) {
      setError(e.message || "Error deleting shelf");
    }
  };

  const handleRename = async (shelfId) => {
    if (!editName.trim()) return;
    setError(null);
    try {
      const updated = await renameShelf(supabase, shelfId, editName.trim());
      setShelves((prev) =>
        prev.map((s) =>
          s.id === shelfId
            ? { ...s, name: updated.name, slug: updated.slug }
            : s
        )
      );
      setEditingId(null);
      setEditName("");
    } catch (e) {
      setError(e.message || "Error renaming shelf");
    }
  };

  const moveShelf = async (index, direction) => {
    const newShelves = [...shelves];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newShelves.length) return;
    [newShelves[index], newShelves[targetIndex]] = [
      newShelves[targetIndex],
      newShelves[index]
    ];
    setShelves(newShelves);
    try {
      await updateShelfOrder(
        supabase,
        newShelves.map((s) => s.id)
      );
    } catch (e) {
      setError(e.message || "Error reordering shelves");
    }
  };

  return (
    <div className="BookshelvesClient min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 pt-28 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            My Bookshelves
          </h1>
          <p className="text-muted-foreground mt-1">
            Organise your books into shelves.
          </p>
        </div>

        {/* Inline error display */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {/* Create new shelf */}
        <div className="flex gap-2">
          <Input
            placeholder="New shelf name..."
            value={newShelfName}
            onChange={(e) => setNewShelfName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button onClick={handleCreate}>Create</Button>
        </div>

        {/* Shelf list */}
        <div className="space-y-6">
          {shelves.map((shelf, index) => (
            <Card key={shelf.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                {editingId === shelf.id ? (
                  <div className="flex gap-2 items-center">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleRename(shelf.id)
                      }
                      className="h-8 w-48"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRename(shelf.id)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <CardTitle className="text-lg">
                    <Link href={`/bookshelves/${shelf.slug}`}>
                      {shelf.name}
                    </Link>
                    {shelf.is_default && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (default)
                      </span>
                    )}
                  </CardTitle>
                )}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveShelf(index, -1)}
                    disabled={index === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveShelf(index, 1)}
                    disabled={index === shelves.length - 1}
                  >
                    ↓
                  </Button>
                  {!shelf.is_default && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(shelf.id);
                          setEditName(shelf.name);
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDelete(shelf.id, shelf.is_default)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {shelf.books?.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {shelf.books.map((book) => (
                      <div key={book.id} className="flex-shrink-0 w-20">
                        {book.cover_url && (
                          <img
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${book.cover_url}`}
                            alt={book.title}
                            className="w-full h-auto rounded-sm shadow-sm"
                          />
                        )}
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {book.title}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-textPrimary">
                    No books on this shelf yet.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}

          {shelves.length === 0 && (
            <p className="text-muted-foreground text-center py-12">
              You don't have any bookshelves yet. Create one above!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
