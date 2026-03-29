"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

// ---------- config ----------

const SUBJECTS = [
  { label: "Fantasy", ol: "fantasy", isbndb: "fantasy" },
  { label: "Epic Fantasy", ol: "epic_fantasy", isbndb: "epic fantasy" },
  { label: "Sci-Fi", ol: "science_fiction", isbndb: "science fiction" },
  { label: "Space Opera", ol: "space_opera", isbndb: "space opera" },
  { label: "Dark Fantasy", ol: "dark_fantasy", isbndb: "dark fantasy" }
];

const DATA_SOURCES = [
  { label: "ISBNDB", id: "isbndb" },
  { label: "OpenLibrary", id: "openlibrary" }
];

// OpenLibrary sub-sources (only relevant when data source = openlibrary)
const OL_SOURCES = [
  { label: "New Releases", id: "new" },
  { label: "Classic", id: "classic" }
];

const PAGE_SIZE = 20;
const OL_COVER = "https://covers.openlibrary.org/b/id";

// ---------- helpers ----------

function olCoverUrl(coverId, size = "M") {
  if (!coverId) return null;
  return `${OL_COVER}/${coverId}-${size}.jpg`;
}

// Unified book shape used throughout the component:
// { _source, key, title, authors:[{name}], cover_url, cover_id,
//   first_publish_year, isbn, description }

function normOLSearchDoc(doc) {
  return {
    _source: "openlibrary",
    key: doc.key,
    title: doc.title,
    cover_id: doc.cover_i || null,
    cover_url: null,
    authors: doc.author_name ? doc.author_name.map((n) => ({ name: n })) : [],
    first_publish_year: doc.first_publish_year || null,
    isbn: doc.isbn?.[0] || null,
    description: null
  };
}

function normOLWork(work) {
  return {
    _source: "openlibrary",
    key: work.key,
    title: work.title,
    cover_id: work.cover_id || null,
    cover_url: null,
    authors: work.authors || [],
    first_publish_year: work.first_publish_year || null,
    isbn: null,
    description: null
  };
}

function normISBNDB(book) {
  return {
    _source: "isbndb",
    _raw_language: book.language || "",
    key: book.isbn13 || book.isbn || book.title,
    title: book.title,
    cover_id: null,
    cover_url: book.image_original || book.image || null,
    authors: (book.authors || []).map((n) => ({ name: n })),
    first_publish_year: book.date_published
      ? String(book.date_published).slice(0, 4)
      : null,
    isbn: book.isbn13 || book.isbn || null,
    description: book.synopsis || book.overview || book.excerpt || null
  };
}

function hasRequiredFields(book) {
  const hasTitle = !!book.title?.trim();
  const hasAuthor =
    book.authors?.length > 0 && (book.authors[0].name || book.authors[0].key);
  const hasCover = !!(book.cover_id || book.cover_url);
  return hasTitle && hasAuthor && hasCover;
}

// ---------- OpenLibrary detail fetchers ----------

async function fetchOLWorkDetails(workKey) {
  try {
    const res = await fetch(`https://openlibrary.org${workKey}.json`);
    const work = await res.json();
    let description = "";
    if (work.description) {
      description =
        typeof work.description === "string"
          ? work.description
          : work.description?.value || "";
    }
    return { description };
  } catch {
    return { description: "" };
  }
}

async function fetchOLAuthorName(authorKey) {
  try {
    const res = await fetch(`https://openlibrary.org${authorKey}.json`);
    const data = await res.json();
    return data.name || "";
  } catch {
    return "";
  }
}

export default function BookDiscover({ onBookSelect }) {
  const supabase = createClient();
  const [dataSource, setDataSource] = useState("isbndb"); // "isbndb" | "openlibrary"
  const [activeSubject, setActiveSubject] = useState(SUBJECTS[0]);
  const [olSource, setOlSource] = useState("new"); // "new" | "classic" — only for OL
  const [books, setBooks] = useState([]);
  const [page, setPage] = useState(1);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [addedKeys, setAddedKeys] = useState(new Set());
  const [existingTitles, setExistingTitles] = useState(new Set());
  const [statusMsg, setStatusMsg] = useState({});
  const [hoveredKey, setHoveredKey] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedBookDetails, setSelectedBookDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Resolve cover image for a book regardless of source
  function bookCoverUrl(book, size = "M") {
    if (book._source === "isbndb") return book.cover_url;
    return olCoverUrl(book.cover_id, size);
  }

  const openBookDetail = useCallback(async (book) => {
    setSelectedBook(book);
    setSelectedBookDetails(null);
    setLoadingDetails(true);
    if (book._source === "isbndb") {
      // Description + author already in the normalised object
      setSelectedBookDetails({
        description: book.description || "",
        authorName: book.authors?.[0]?.name || ""
      });
      setLoadingDetails(false);
    } else {
      const { description } = await fetchOLWorkDetails(book.key);
      let authorName = "";
      if (book.authors?.length) {
        authorName =
          book.authors[0].name ||
          (await fetchOLAuthorName(book.authors[0].key));
      }
      setSelectedBookDetails({ description, authorName });
      setLoadingDetails(false);
    }
  }, []);

  useEffect(() => {
    async function loadExisting() {
      const { data } = await supabase.from("books").select("title");
      if (data) {
        setExistingTitles(
          new Set(data.map((b) => b.title.toLowerCase().trim()))
        );
      }
    }
    loadExisting();
  }, []);

  // ---- fetchers ----

  const fetchISBNDB = useCallback(
    async (subject, pageNum = 1, append = false) => {
      append ? setLoadingMore(true) : setLoading(true);
      try {
        const url = `/api/books/isbndb?q=${encodeURIComponent(subject.isbndb)}&page=${pageNum}&pageSize=${PAGE_SIZE}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`ISBNDB ${res.status}`);
        const data = await res.json();
        const works = (data.books || [])
          .map(normISBNDB)
          .filter(hasRequiredFields)
          .filter((b) => !!b.description)
          .filter((b) => {
            // Drop non-English books (ISBNDB language field: "en" or absent)
            const lang = (b._raw_language || "").toLowerCase();
            return !lang || lang === "en" || lang.startsWith("eng");
          });
        append ? setBooks((prev) => [...prev, ...works]) : setBooks(works);
        setPage(pageNum + 1);
      } catch (e) {
        console.error("ISBNDB fetch error:", e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  const fetchOL = useCallback(
    async (subject, src, newOffset = 0, append = false) => {
      append ? setLoadingMore(true) : setLoading(true);
      try {
        let works = [];
        if (src === "new") {
          const url = `https://openlibrary.org/search.json?subject=${subject.ol}&sort=new&language=eng&limit=${PAGE_SIZE}&offset=${newOffset}&fields=key,title,author_name,cover_i,first_publish_year,isbn`;
          const res = await fetch(url);
          const data = await res.json();
          works = (data.docs || [])
            .map(normOLSearchDoc)
            .filter(hasRequiredFields);
        } else {
          const url = `https://openlibrary.org/subjects/${subject.ol}.json?limit=${PAGE_SIZE}&offset=${newOffset}`;
          const res = await fetch(url);
          const data = await res.json();
          works = (data.works || []).map(normOLWork).filter(hasRequiredFields);
        }
        append ? setBooks((prev) => [...prev, ...works]) : setBooks(works);
        setOffset(newOffset + PAGE_SIZE);
      } catch (e) {
        console.error("OpenLibrary fetch error:", e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Reload when source / subject / OL-sub-source changes
  useEffect(() => {
    setBooks([]);
    setPage(1);
    setOffset(0);
    if (dataSource === "isbndb") {
      fetchISBNDB(activeSubject, 1, false);
    } else {
      fetchOL(activeSubject, olSource, 0, false);
    }
  }, [dataSource, activeSubject, olSource, fetchISBNDB, fetchOL]);

  function handleLoadMore() {
    if (dataSource === "isbndb") {
      fetchISBNDB(activeSubject, page, true);
    } else {
      fetchOL(activeSubject, olSource, offset, true);
    }
  }

  // ---- upload / add / populate ----

  const uploadCoverFromUrl = async (imageUrl) => {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { data, error } = await supabase.storage
        .from("books")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: false });
      if (error) return null;
      return data.path;
    } catch {
      return null;
    }
  };

  const handleQuickAdd = async (book) => {
    const workKey = book.key;
    setAddingId(workKey);
    setStatusMsg((prev) => ({ ...prev, [workKey]: "Fetching..." }));
    try {
      let description = book.description || "";
      let authorName = book.authors?.[0]?.name || "";

      if (book._source === "openlibrary") {
        if (!description) {
          const det = await fetchOLWorkDetails(workKey);
          description = det.description;
        }
        if (!authorName && book.authors?.[0]?.key) {
          authorName = await fetchOLAuthorName(book.authors[0].key);
        }
      }

      if (!description) {
        setStatusMsg((prev) => ({ ...prev, [workKey]: "No description" }));
        setAddingId(null);
        return;
      }
      if (existingTitles.has(book.title.toLowerCase().trim())) {
        setStatusMsg((prev) => ({ ...prev, [workKey]: "Already in DB" }));
        setAddingId(null);
        return;
      }

      setStatusMsg((prev) => ({ ...prev, [workKey]: "Uploading cover..." }));
      const imgUrl = bookCoverUrl(book, "L");
      const storagePath = imgUrl ? await uploadCoverFromUrl(imgUrl) : null;
      if (!storagePath) {
        setStatusMsg((prev) => ({ ...prev, [workKey]: "Cover failed" }));
        setAddingId(null);
        return;
      }

      setStatusMsg((prev) => ({ ...prev, [workKey]: "Saving..." }));
      const { error } = await supabase.from("books").insert([
        {
          title: book.title.trim(),
          authors: authorName ? [authorName] : [],
          description: description.trim(),
          cover_url: storagePath,
          source: "discover"
        }
      ]);
      if (error) {
        setStatusMsg((prev) => ({
          ...prev,
          [workKey]: `Error: ${error.message}`
        }));
      } else {
        setStatusMsg((prev) => ({ ...prev, [workKey]: "Added" }));
        setAddedKeys((prev) => new Set(prev).add(workKey));
        setExistingTitles((prev) =>
          new Set(prev).add(book.title.toLowerCase().trim())
        );
      }
    } catch (e) {
      setStatusMsg((prev) => ({ ...prev, [workKey]: `Error: ${e.message}` }));
    } finally {
      setAddingId(null);
    }
  };

  const handlePopulateForm = async (book) => {
    if (!onBookSelect) return;
    const workKey = book.key;
    setAddingId(workKey);

    let description = book.description || "";
    let authorName = book.authors?.[0]?.name || "";

    if (book._source === "openlibrary") {
      if (!description) {
        const det = await fetchOLWorkDetails(workKey);
        description = det.description;
      }
      if (!authorName && book.authors?.[0]?.key) {
        authorName = await fetchOLAuthorName(book.authors[0].key);
      }
    }

    const imgUrl = bookCoverUrl(book, "L");
    onBookSelect({
      title: book.title,
      authors: authorName ? [authorName] : [],
      synopsis: description,
      image_original: imgUrl,
      image: imgUrl,
      prices: []
    });
    setStatusMsg((prev) => ({ ...prev, [workKey]: "Sent to form" }));
    setAddingId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Data source toggle */}
      <div className="flex gap-1">
        {DATA_SOURCES.map((ds) => (
          <button
            key={ds.id}
            onClick={() => setDataSource(ds.id)}
            className={`font-departureMono uppercase text-[10px] px-3 py-1.5 border transition-colors ${
              dataSource === ds.id
                ? "bg-white text-[#0D00FF] border-white"
                : "bg-transparent text-white border-white/40 hover:border-white"
            }`}
          >
            {ds.label}
          </button>
        ))}
        {dataSource === "openlibrary" && (
          <div className="flex gap-1 ml-2 border-l border-white/20 pl-2">
            {OL_SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => setOlSource(s.id)}
                className={`font-departureMono uppercase text-[10px] px-3 py-1.5 border transition-colors ${
                  olSource === s.id
                    ? "bg-white/20 text-white border-white"
                    : "bg-transparent text-white/50 border-white/20 hover:border-white/60 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Genre tabs */}
      <div className="flex flex-wrap gap-1">
        {SUBJECTS.map((s) => (
          <button
            key={s.ol}
            onClick={() => setActiveSubject(s)}
            className={`font-departureMono uppercase text-[10px] px-3 py-1 border transition-colors ${
              activeSubject.ol === s.ol
                ? "bg-white/20 text-white border-white"
                : "bg-transparent text-white/50 border-white/20 hover:border-white/60 hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-white font-departureMono text-[11px]">Loading...</p>
      ) : (
        <>
          {/* Cover grid */}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 xl:grid-cols-8 gap-2">
            {books.filter(hasRequiredFields).map((book, index) => {
              const workKey = book.key || index;
              const img = bookCoverUrl(book, "M");
              const isAdding = addingId === workKey;
              const isAdded = addedKeys.has(workKey);
              const isDupe = existingTitles.has(
                book.title.toLowerCase().trim()
              );
              const isHovered = hoveredKey === workKey;

              return (
                <div
                  key={`${workKey}-${index}`}
                  className="relative group cursor-pointer"
                  onClick={() => openBookDetail(book)}
                  onMouseEnter={() => setHoveredKey(workKey)}
                  onMouseLeave={() => setHoveredKey(null)}
                >
                  <div className="aspect-[2/3] bg-white/10 overflow-hidden">
                    <img
                      src={img}
                      alt={book.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {/* Year badge */}
                    {book.first_publish_year && (
                      <div className="absolute top-1 left-1 bg-black/70 text-white font-departureMono text-[8px] px-1 py-0.5 leading-none">
                        {book.first_publish_year}
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div
                      className={`absolute inset-0 bg-black/70 flex flex-col items-center justify-end p-1 transition-opacity ${
                        isHovered ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <p className="text-white font-departureMono text-[8px] text-center leading-tight line-clamp-3">
                        {book.title}
                      </p>
                      {(isAdded || isDupe) && (
                        <span className="text-white/40 font-departureMono text-[7px] mt-0.5">
                          {isDupe ? "in db" : "added"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {books.length > 0 && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full font-departureMono uppercase text-[11px] text-white border border-white/40 py-2 hover:border-white hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </>
      )}

      {/* Book detail modal */}
      {selectedBook &&
        (() => {
          const detailWorkKey = selectedBook.key || selectedBook.id;
          const detailImg = bookCoverUrl(selectedBook, "L");
          const isAdding = addingId === detailWorkKey;
          const isAdded = addedKeys.has(detailWorkKey);
          const isDupe = existingTitles.has(
            selectedBook.title.toLowerCase().trim()
          );
          const status = statusMsg[detailWorkKey];
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
              onClick={() => setSelectedBook(null)}
            >
              <div
                className="relative bg-[#0a0a0a] border border-white/20 max-w-xl w-full mx-4 flex gap-5 p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedBook(null)}
                  className="absolute top-3 right-3 text-white/40 hover:text-white font-departureMono text-[11px] uppercase"
                >
                  ✕
                </button>

                {/* Cover */}
                <div className="w-28 flex-shrink-0">
                  {detailImg ? (
                    <img
                      src={detailImg}
                      alt={selectedBook.title}
                      className="w-full object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-white/10" />
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-col gap-3 flex-1 min-w-0">
                  <div>
                    <p className="text-white font-departureMono text-[13px] leading-snug">
                      {selectedBook.title}
                    </p>
                    {selectedBookDetails?.authorName && (
                      <p className="text-white/70 font-departureMono text-[11px] mt-0.5">
                        {selectedBookDetails.authorName}
                      </p>
                    )}
                    {selectedBook.first_publish_year && (
                      <p className="text-white/40 font-departureMono text-[10px] mt-0.5">
                        {selectedBook.first_publish_year}
                      </p>
                    )}
                    {selectedBook.isbn && (
                      <p className="text-white/30 font-departureMono text-[9px] mt-0.5">
                        ISBN: {selectedBook.isbn}
                      </p>
                    )}
                  </div>

                  {loadingDetails ? (
                    <p className="text-white/40 font-departureMono text-[10px]">
                      Loading details...
                    </p>
                  ) : selectedBookDetails?.description ? (
                    <p className="text-white/60 font-departureMono text-[10px] leading-relaxed overflow-y-auto max-h-32">
                      {selectedBookDetails.description}
                    </p>
                  ) : (
                    <p className="text-white/30 font-departureMono text-[10px] italic">
                      No description available
                    </p>
                  )}

                  {status && (
                    <p className="text-orange-300 font-departureMono text-[10px]">
                      {status}
                    </p>
                  )}

                  <div className="flex gap-2 mt-auto pt-2">
                    <button
                      onClick={() => handleQuickAdd(selectedBook)}
                      disabled={isAdding || isAdded || isDupe}
                      className={`font-departureMono uppercase text-[10px] px-3 py-1.5 border transition-colors ${
                        isAdded || isDupe
                          ? "border-white/20 text-white/30 cursor-not-allowed"
                          : isAdding
                            ? "border-orange-400 text-orange-400"
                            : "border-white text-white hover:bg-white hover:text-[#0D00FF]"
                      }`}
                    >
                      {isDupe
                        ? "In DB"
                        : isAdded
                          ? "Added"
                          : isAdding
                            ? "Adding..."
                            : "Add to DB"}
                    </button>
                    {onBookSelect && (
                      <button
                        onClick={() => {
                          handlePopulateForm(selectedBook);
                          setSelectedBook(null);
                        }}
                        disabled={isAdding}
                        className="font-departureMono uppercase text-[10px] px-3 py-1.5 border border-white/40 text-white/70 hover:border-white hover:text-white transition-colors"
                      >
                        Populate Form
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
