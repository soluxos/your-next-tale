"use client";
import AdminFieldRow from "./AdminFieldRow";
import CoverCandidateStrip from "./CoverCandidateStrip";

export default function AdminEditPanel({
  book,
  draft,
  candidates,
  fetchingCandidates,
  fetchError,
  saving,
  saveError,
  savedOk,
  dirtyFields,
  updateField,
  selectCoverCandidate,
  fetchCandidates,
  onCancel,
  save
}) {
  const isDirty = dirtyFields.size > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div className="flex-1 min-w-0 mr-3">
          <p className="font-departureMono uppercase text-[9px] text-textSecondary">
            Admin — Editing
          </p>
          <p className="font-ppMondwest text-[18px] leading-tight mt-0.5 line-clamp-1">
            {draft.title || book.title}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Single refetch button for all fields */}
          <button
            onClick={fetchCandidates}
            disabled={fetchingCandidates}
            className="font-departureMono uppercase text-[8px] text-textSecondary
                       hover:text-textPrimary disabled:opacity-40
                       flex items-center gap-1 transition-colors"
          >
            {fetchingCandidates ? (
              "Fetching..."
            ) : (
              <>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M23 4v6h-6M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
                {candidates ? "Re-fetch" : "Fetch candidates"}
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            className="font-departureMono uppercase text-[9px] text-textSecondary
                       hover:text-textPrimary transition-colors"
          >
            {isDirty ? "Discard" : "Cancel"}
          </button>
        </div>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <p className="font-departureMono uppercase text-[9px] text-red-500 px-5 pt-3 shrink-0">
          {fetchError}
        </p>
      )}

      {/* Hint when no candidates yet */}
      {!candidates && !fetchingCandidates && (
        <p className="font-departureMono uppercase text-[8px] text-textSecondary px-5 pt-3 shrink-0">
          Click &quot;Fetch candidates&quot; to load alternatives from ISBNdb
        </p>
      )}
      {candidates?.length === 0 && (
        <p className="font-departureMono uppercase text-[8px] text-textSecondary px-5 pt-3 shrink-0">
          No candidates found in ISBNdb
        </p>
      )}

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Cover field */}
        <div className="mb-5">
          <label className="block font-departureMono uppercase text-[9px] text-textSecondary mb-2">
            Cover Image
          </label>

          {/* Cover preview + URL input */}
          <div className="flex items-start gap-3">
            <div className="w-16 h-24 rounded-[6px] overflow-hidden bg-[#f4f4f4] shrink-0">
              {draft.cover_preview ? (
                <img
                  src={draft.cover_preview}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="font-departureMono text-[8px] text-textSecondary text-center px-1">
                    No cover
                  </p>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <input
                type="url"
                value={draft.cover_url_remote || ""}
                onChange={(e) => {
                  updateField("cover_url_remote", e.target.value);
                  updateField("cover_preview", e.target.value);
                }}
                placeholder="Paste a direct image URL..."
                className="w-full font-departureMono text-[10px] text-textPrimary
                           border border-border rounded-[6px] px-3 py-2
                           focus:outline-none focus:border-[#1f1f1f] bg-white"
              />
              <p className="font-departureMono uppercase text-[8px] text-textSecondary mt-1">
                Current file: {book.cover_url || "none"}
              </p>
              {draft.cover_url_remote && (
                <p className="font-departureMono uppercase text-[8px] text-[#16a34a] mt-0.5">
                  New cover will be uploaded on save
                </p>
              )}
            </div>
          </div>

          {/* Cover candidates — shown whenever loaded */}
          {candidates?.length > 0 && (
            <div className="mt-3">
              <p className="font-departureMono uppercase text-[8px] text-textSecondary mb-1">
                {candidates.flatMap((c) => c.cover_urls).filter(Boolean).length}{" "}
                covers found — click to select
              </p>
              <CoverCandidateStrip
                candidates={candidates}
                selectedUrl={draft.cover_url_remote || draft.cover_preview}
                onSelect={selectCoverCandidate}
              />
            </div>
          )}
        </div>

        <div className="border-t border-border mb-4" />

        {/* Title */}
        <AdminFieldRow
          label="Title"
          field="title"
          value={draft.title}
          onChange={(v) => updateField("title", v)}
          candidates={candidates}
        />

        {/* Authors */}
        <AdminFieldRow
          label="Authors (comma-separated)"
          field="authors"
          value={
            Array.isArray(draft.authors)
              ? draft.authors.join(", ")
              : draft.authors
          }
          onChange={(v) =>
            updateField(
              "authors",
              v
                .split(",")
                .map((a) => a.trim())
                .filter(Boolean)
            )
          }
          candidates={candidates}
        />

        {/* Description */}
        <AdminFieldRow
          label="Description"
          field="description"
          value={draft.description}
          onChange={(v) => updateField("description", v)}
          candidates={candidates}
          multiline
        />

        {/* ISBN-13 */}
        <AdminFieldRow
          label="ISBN-13"
          field="isbn_13"
          value={draft.isbn_13}
          onChange={(v) => updateField("isbn_13", v)}
          candidates={candidates}
        />

        {/* ISBN-10 */}
        <AdminFieldRow
          label="ISBN-10"
          field="isbn_10"
          value={draft.isbn_10}
          onChange={(v) => updateField("isbn_10", v)}
          candidates={candidates}
        />

        {/* Publisher */}
        <AdminFieldRow
          label="Publisher"
          field="publisher"
          value={draft.publisher}
          onChange={(v) => updateField("publisher", v)}
          candidates={candidates}
        />

        {/* Published date */}
        <AdminFieldRow
          label="Published Date"
          field="published_date"
          value={draft.published_date}
          onChange={(v) => updateField("published_date", v)}
          candidates={candidates}
        />

        {/* Page count */}
        <AdminFieldRow
          label="Page Count"
          field="page_count"
          value={draft.page_count}
          onChange={(v) => updateField("page_count", v)}
          candidates={candidates}
          type="number"
        />

        {/* Genres */}
        <AdminFieldRow
          label="Genres (comma-separated)"
          field="genres"
          value={
            Array.isArray(draft.genres) ? draft.genres.join(", ") : draft.genres
          }
          onChange={(v) =>
            updateField(
              "genres",
              v
                .split(",")
                .map((g) => g.trim().toLowerCase())
                .filter(Boolean)
            )
          }
          candidates={candidates}
        />

        {/* Language */}
        <AdminFieldRow
          label="Language"
          field="language"
          value={draft.language}
          onChange={(v) => updateField("language", v)}
          candidates={candidates}
        />

        {/* Incomplete flag */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.is_incomplete}
              onChange={(e) => updateField("is_incomplete", e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border"
            />
            <span className="font-departureMono uppercase text-[9px] text-textSecondary">
              Mark as incomplete
            </span>
          </label>
        </div>
      </div>

      {/* Footer — save button */}
      <div className="px-5 py-4 border-t border-border shrink-0">
        {saveError && (
          <p className="font-departureMono uppercase text-[9px] text-red-500 mb-3">
            {saveError}
          </p>
        )}

        {savedOk && (
          <p className="font-departureMono uppercase text-[9px] text-[#16a34a] mb-3">
            ✓ Saved successfully
          </p>
        )}

        <button
          onClick={save}
          disabled={saving || !isDirty}
          className="w-full h-10 rounded-[8px] font-departureMono uppercase text-[10px]
                     bg-[#1f1f1f] text-white hover:bg-[#353535] transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving
            ? "Saving..."
            : isDirty
              ? `Save ${dirtyFields.size} change${dirtyFields.size === 1 ? "" : "s"}`
              : "No changes"}
        </button>

        {isDirty && (
          <p className="font-departureMono uppercase text-[8px] text-textSecondary text-center mt-2">
            Unsaved changes will be lost if you close the panel
          </p>
        )}
      </div>
    </div>
  );
}
