"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";

export default function AdminBooksPage() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("books")
        .select(
          "id, title, authors, isbn_13, isbn_10, cover_url, is_incomplete, source, created_at"
        )
        .order("created_at", { ascending: false });
      setBooks(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return books;
    const q = search.toLowerCase();
    return books.filter(
      (b) =>
        b.title?.toLowerCase().includes(q) ||
        b.authors?.[0]?.toLowerCase().includes(q) ||
        b.isbn_13?.includes(q) ||
        b.isbn_10?.includes(q)
    );
  }, [books, search]);

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/books/${id}`, { method: "DELETE" });
      if (res.ok) {
        setBooks((prev) => prev.filter((b) => b.id !== id));
      }
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  };

  const coverUrl = (filename) => {
    if (!filename) return null;
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${filename}`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-[#e8e8e8] rounded-[8px] animate-pulse" />
        <div className="h-10 w-full bg-[#e8e8e8] rounded-[8px] animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-16 w-full bg-[#e8e8e8] rounded-[8px] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-departureMono uppercase text-[10px] text-textSecondary">
          Library
        </p>
        <p className="font-ppMondwest text-textPrimary text-[28px] mt-1">
          All Books
        </p>
        <p className="font-departureMono text-[10px] text-textSecondary mt-1">
          {books.length} total
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by title, author, or ISBN…"
        className="w-full bg-white border border-border rounded-[8px] px-4 py-3 font-departureMono text-[11px] text-textPrimary placeholder:text-textSecondary outline-none focus:border-[#1f1f1f] transition-colors"
      />

      {/* Table */}
      <div className="border border-border rounded-[8px] overflow-hidden">
        <div className="grid grid-cols-[48px_1fr_160px_140px_80px_80px] gap-3 px-4 py-2 border-b border-border bg-[#f8f8f8]">
          <span className="font-departureMono uppercase text-[9px] text-textSecondary">
            Cover
          </span>
          <span className="font-departureMono uppercase text-[9px] text-textSecondary">
            Title
          </span>
          <span className="font-departureMono uppercase text-[9px] text-textSecondary">
            Author
          </span>
          <span className="font-departureMono uppercase text-[9px] text-textSecondary">
            ISBN-13
          </span>
          <span className="font-departureMono uppercase text-[9px] text-textSecondary">
            Status
          </span>
          <span className="font-departureMono uppercase text-[9px] text-textSecondary" />
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="font-departureMono text-[11px] text-textSecondary">
              {search ? "No books match your search." : "No books in database."}
            </p>
          </div>
        )}

        {filtered.map((book) => (
          <div
            key={book.id}
            className="grid grid-cols-[48px_1fr_160px_140px_80px_80px] gap-3 px-4 py-2 border-b border-border items-center hover:bg-[#f8f8f8] transition-colors"
          >
            {/* Cover */}
            <div className="w-8 h-12 rounded-[3px] overflow-hidden bg-[#f0f0f0] shrink-0">
              {book.cover_url && (
                <img
                  src={coverUrl(book.cover_url)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Title */}
            <p className="font-ppMondwest text-textPrimary text-[14px] truncate">
              {book.title}
            </p>

            {/* Author */}
            <p className="font-departureMono text-[10px] text-textSecondary truncate">
              {book.authors?.[0] || "—"}
            </p>

            {/* ISBN */}
            <p className="font-mono text-[10px] text-textSecondary">
              {book.isbn_13 || book.isbn_10 || "—"}
            </p>

            {/* Status */}
            <div>
              {book.is_incomplete ? (
                <span className="bg-yellow-100 text-yellow-700 font-departureMono uppercase text-[9px] rounded-[6px] px-2 py-0.5">
                  Incomplete
                </span>
              ) : (
                <span className="bg-green-100 text-green-700 font-departureMono uppercase text-[9px] rounded-[6px] px-2 py-0.5">
                  Complete
                </span>
              )}
            </div>

            {/* Delete */}
            <div className="flex justify-end">
              {confirmId === book.id ? (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleDelete(book.id)}
                    disabled={deleting === book.id}
                    className="font-departureMono uppercase text-[9px] text-red-600 hover:text-red-700 disabled:opacity-40"
                  >
                    {deleting === book.id ? "..." : "Yes"}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="font-departureMono uppercase text-[9px] text-textSecondary hover:text-textPrimary"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(book.id)}
                  className="font-departureMono uppercase text-[9px] text-textSecondary hover:text-red-600 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
