"use client";
import { useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

export function useAdminBookEdit(book) {
  // Whether edit mode is active
  const [isEditing, setIsEditing] = useState(false);

  // The working copy of all fields — starts from the current book data
  const [draft, setDraft] = useState(null);

  // Per-field candidate lists fetched from ISBNdb
  const [candidates, setCandidates] = useState(null); // full candidate array
  const [fetchingCandidates, setFetchingCandidates] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedOk, setSavedOk] = useState(false);

  // Tracks which fields have been changed from the original book
  const [dirtyFields, setDirtyFields] = useState(new Set());

  async function enterEditMode() {
    // Shelf lists carry trimmed book rows. Editing saves every field, so start
    // from the full record or the missing ones would be blanked.
    let full = book;
    if (!("description" in book)) {
      const { data, error } = await createClient().from("books").select("*").eq("id", book.id).single();
      if (error || !data) {
        setFetchError("Couldn’t load this book for editing.");
        return;
      }
      full = data;
    }
    setDraft({
      title: full.title || "",
      authors: full.authors || [],
      description: full.description || "",
      isbn_13: full.isbn_13 || "",
      isbn_10: full.isbn_10 || "",
      publisher: full.publisher || "",
      published_date: full.published_date || "",
      page_count: full.page_count || "",
      language: full.language || "",
      genres: full.genres || [],
      is_incomplete: full.is_incomplete || false,
      // cover fields
      cover_url: full.cover_url || "", // current stored filename
      cover_url_remote: null, // remote URL to re-upload on save
      cover_preview: full.cover_url // what's shown in the preview
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/books/${full.cover_url}`
        : null
    });
    setDirtyFields(new Set());
    setCandidates(null);
    setFetchError(null);
    setSaveError(null);
    setSavedOk(false);
    setIsEditing(true);
  }

  function exitEditMode() {
    setIsEditing(false);
    setDraft(null);
    setCandidates(null);
    setDirtyFields(new Set());
  }

  function updateField(field, value) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setDirtyFields((prev) => new Set([...prev, field]));
  }

  // Select a cover candidate — sets the remote URL to re-upload on save
  // and updates the preview immediately
  function selectCoverCandidate(remoteUrl) {
    setDraft((prev) => ({
      ...prev,
      cover_url_remote: remoteUrl,
      cover_preview: remoteUrl
    }));
    setDirtyFields((prev) => new Set([...prev, "cover"]));
  }

  // Select a text-field candidate from a fetched ISBNdb result
  function applyCandidate(candidateIndex) {
    const c = candidates?.[candidateIndex];
    if (!c) return;
    const updates = {};
    if (c.title) updates.title = c.title;
    if (c.authors?.length) updates.authors = c.authors;
    if (c.description) updates.description = c.description;
    if (c.isbn_13) updates.isbn_13 = c.isbn_13;
    if (c.isbn_10) updates.isbn_10 = c.isbn_10;
    if (c.publisher) updates.publisher = c.publisher;
    if (c.published_date) updates.published_date = c.published_date;
    if (c.page_count) updates.page_count = c.page_count;
    if (c.genres?.length) updates.genres = c.genres;
    // Set first cover as pending remote upload
    if (c.cover_urls?.[0]) {
      updates.cover_url_remote = c.cover_urls[0];
      updates.cover_preview = c.cover_urls[0];
    }

    setDraft((prev) => ({ ...prev, ...updates }));
    setDirtyFields((prev) => {
      const next = new Set(prev);
      Object.keys(updates).forEach((k) => next.add(k));
      return next;
    });
  }

  // Fetch candidates from the refetch API
  const fetchCandidates = useCallback(async () => {
    setFetchingCandidates(true);
    setFetchError(null);
    setCandidates(null);
    try {
      const res = await fetch(`/api/admin/books/${book.id}/refetch`, {
        method: "POST"
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Refetch failed");
      }
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (e) {
      setFetchError(e.message);
    } finally {
      setFetchingCandidates(false);
    }
  }, [book.id]);

  // Save all draft changes to the DB — returns true on success, false on error
  async function save() {
    setSaving(true);
    setSaveError(null);
    setSavedOk(false);
    let success = false;
    try {
      const payload = {
        title: draft.title,
        authors: draft.authors,
        description: draft.description || null,
        isbn_13: draft.isbn_13 || null,
        isbn_10: draft.isbn_10 || null,
        publisher: draft.publisher || null,
        published_date: draft.published_date || null,
        page_count: draft.page_count ? parseInt(draft.page_count, 10) : null,
        language: draft.language || null,
        genres: draft.genres || []
      };
      // Include remote cover URL if a new cover was selected
      if (draft.cover_url_remote) {
        payload.cover_url_remote = draft.cover_url_remote;
      }

      const res = await fetch(`/api/admin/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }
      const data = await res.json();
      setSavedOk(true);
      setDirtyFields(new Set());
      success = data.book;
      // Exit edit mode after a short delay so the admin sees the confirmation
      setTimeout(() => exitEditMode(), 1200);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
    return success;
  }

  return {
    isEditing,
    draft,
    candidates,
    fetchingCandidates,
    fetchError,
    saving,
    saveError,
    savedOk,
    dirtyFields,
    enterEditMode,
    exitEditMode,
    updateField,
    selectCoverCandidate,
    applyCandidate,
    fetchCandidates,
    save
  };
}
